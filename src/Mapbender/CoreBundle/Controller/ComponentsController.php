<?php


namespace Mapbender\CoreBundle\Controller;


use Mapbender\Component\AutoMimeResponseFile;
use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Controller to deliver assets from various vendor paths from /components/ urls.
 * Only answers if file does not actually exist in web/components (see example rewrite configuration in .htaccess).
 * Having this Controller allows installing and requesting /components/ packages even without having
 * a "component installer" package, such as robloach/component-installer (abandoned) or
 * mnsami/composer-custom-directory-installer on the system.
 */
class ComponentsController extends Controller
{
    /**
     * @Route("/components/{packageName}/{path}", methods={"GET"}, requirements={"path"=".+"})
     * @param Request $request
     * @param string $packageName
     * @param string $path
     * @return Response
     */
    public function componentsAction(Request $request, $packageName, $path)
    {
        if ($this->matchHidden($path)) {
            throw new NotFoundHttpException();
        }
        $fileInfo = $this->locateFile($packageName, $path);
        if (!$fileInfo) {
            throw new NotFoundHttpException();
        }
        $response = new BinaryFileResponse($fileInfo);
        $response->isNotModified($request);
        return $response;
    }

    /**
     * @param string $packageName
     * @param string $filePath
     * @return \SplFileInfo|null
     */
    protected function locateFile($packageName, $filePath)
    {
        $packagePath = $this->getPackagePath($packageName);
        if ($packagePath) {
            $fullPath = "{$packagePath}/{$filePath}";

            if (\is_readable($fullPath) && !\is_dir($fullPath)) {
                return new AutoMimeResponseFile($fullPath);
            }
        }
        return null;
    }

    /**
     * @param string $packageName
     * @return string|null
     */
    protected function getPackagePath($packageName)
    {
        switch ($packageName) {
            default:
                $path = $this->getVendorPath() . "/components/{$packageName}";
                break;
            case 'bootstrap-colorpicker':
                $path = $this->getWebPath() . '/bundles/mapbendercore/bootstrap-colorpicker';
                $path = $this->getVendorPath() . "/debugteam/{$packageName}";
                break;
            case 'mapbender-icons':
                $path = $this->getVendorPath() . "/mapbender/{$packageName}";
                break;
            case 'open-sans':
                $path = $this->getVendorPath() . "/wheregroup/{$packageName}";
                break;
        }
        if (\is_dir($path) && \is_readable($path)) {
            return $path;
        } else {
            return null;
        }
    }

    /**
     * @return string
     */
    protected function getVendorPath()
    {
        return realpath($this->getParameter('kernel.root_dir') . '/../vendor');
    }

    protected function getWebPath()
    {
        return realpath($this->getParameter('kernel.root_dir') . '/../web');
    }

    /**
     * @param string $path
     * @return bool
     */
    protected function matchHidden($path)
    {
        $patterns = array(
            '#(^|/)\.#',
            '#(^|/)(composer|component|package|bower).json$#',
            '#(^|/)[^/]+\.(md|txt)$#',
            '#(^|/)Makefile[^/]*$#',
        );
        foreach ($patterns as $pattern) {
            if (\preg_match($pattern, $path)) {
                return true;
            }
        }
        return false;
    }
}
