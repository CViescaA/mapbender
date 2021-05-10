<?php

namespace Mapbender\CoreBundle\Element\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class OverviewAdminType extends AbstractType
{
    /**
     * @inheritdoc
     */
    public function configureOptions(OptionsResolver $resolver)
    {
        $resolver->setDefaults(array(
            'application' => null,
        ));
    }

    /**
     * @inheritdoc
     */
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        // @todo: add missing field labels
        $builder
            ->add('layerset', 'Mapbender\CoreBundle\Element\Type\LayersetAdminType', array(
                'application' => $options['application'],
                'required' => true,
            ))
            ->add('target', 'Mapbender\CoreBundle\Element\Type\TargetElementType', array(
                'element_class' => 'Mapbender\\CoreBundle\\Element\\Map',
                'application'   => $options['application'],
                'required' => false,
            ))
            ->add('anchor', 'Mapbender\ManagerBundle\Form\Type\Element\FloatingAnchorType')
            ->add('maximized', 'Symfony\Component\Form\Extension\Core\Type\CheckboxType', array(
                'required' => false,
                'label' => 'mb.manager.admin.overview.maximize',
            ))
            ->add('fixed', 'Symfony\Component\Form\Extension\Core\Type\CheckboxType', array(
                'required' => false,
                'label' => 'mb.manager.admin.overview.fix',
            ))
            // @todo: this should be a positive integer
            ->add('width', 'Symfony\Component\Form\Extension\Core\Type\TextType')
            // @todo: this should be a positive integer
            ->add('height', 'Symfony\Component\Form\Extension\Core\Type\TextType')
        ;
    }

}
